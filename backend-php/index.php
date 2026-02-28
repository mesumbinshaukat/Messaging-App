<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;
use Dotenv\Dotenv;

require __DIR__ . '/vendor/autoload.php';

// Load environment variables
if (file_exists(__DIR__ . '/.env')) {
    $dotenv = Dotenv::createImmutable(__DIR__);
    $dotenv->load();
}

$app = AppFactory::create();

// Add Error Middleware
$app->addErrorMiddleware(true, true, true);

// Add JSON body parsing middleware
$app->addBodyParsingMiddleware();

// Base route
$app->get('/', function (Request $request, Response $response) {
    $response->getBody()->write(json_encode(['status' => 'PM PHP Backend Running']));
    return $response->withHeader('Content-Type', 'application/json');
});

// Import specific routes
require __DIR__ . '/src/Routes/AuthRoutes.php';
require __DIR__ . '/src/Routes/ContactRoutes.php';
require __DIR__ . '/src/Routes/MessageRoutes.php';
require __DIR__ . '/src/Routes/PollRoutes.php';

$app->run();
